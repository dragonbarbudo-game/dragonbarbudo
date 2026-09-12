/* =========================
   TavernScene — La Taberna del Cuervo (interior, Zona 2)
   -------------------------------------------------------
   Primera "escena interior" del juego: una sala pequeña y cerrada, en
   vez del mundo exterior continuo de GameScene. Reutiliza el mismo
   motor de movimiento libre (worldX/worldY, colisión por distancia,
   depth sorting dinámico) a una escala mucho más pequeña.

   Se entra acercándose al edificio en el exterior (ver
   GameScene.enterTavern) — automático, sin pulsar nada. Para SALIR sí
   hace falta una acción explícita: caminar hasta la casilla de la
   puerta (marcada en el suelo) o pulsar el botón "🚪 Salir" — cualquiera
   de las dos te devuelve a GameScene justo donde estaba la entrada.

   Solo existe en modo solitario (GameScene.enterTavern ya lo filtra):
   sincronizar una escena interior aparte con un amigo en tiempo real
   queda fuera del alcance de esta primera versión.
========================= */
const TAVERN_COLS = 6;
const TAVERN_ROWS = 5;
const TAVERN_WALL_ROW = 0; // fila del fondo, bloqueada por completo (ver blockedByWall)
const TAVERN_FIREPLACE_COL = 3;
const TAVERN_BAR_SPOTS = [[1.5, 1, 55], [3.5, 1, 55]]; // [gx, gy, radio] — dos tramos que cubren la barra
const TAVERN_TABLE_SPOTS = [[1, 3], [4, 3]];
const TAVERN_BARREL_SPOTS = [[0, 2], [5, 2]];
const TAVERN_DOOR_TILE = [3, 4];
const TAVERN_EXIT_RADIUS = 40;

class TavernScene extends Phaser.Scene {
  constructor() { super('TavernScene'); }

  init(data) {
    // A dónde volver en GameScene al salir (justo fuera de la puerta
    // exterior) — lo manda GameScene.enterTavern.
    this.returnAt = (data && data.returnAt) || { x: TILE_SIZE * 1.5, y: TILE_SIZE * 1.5 };
  }

  create() {
    this.exiting = false;

    this.buildRoom();
    this.buildFurniture();
    this.buildPlayer();
    this.buildHud();

    const roomW = TAVERN_COLS * TILE_SIZE, roomH = TAVERN_ROWS * TILE_SIZE;
    this.cameras.main.setBounds(0, 0, roomW, roomH * ISO_SQUISH);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' });
  }

  buildRoom() {
    const doorWX = TAVERN_DOOR_TILE[0] * TILE_SIZE + TILE_SIZE / 2, doorWY = TAVERN_DOOR_TILE[1] * TILE_SIZE + TILE_SIZE / 2;
    this.doorSpot = { worldX: doorWX, worldY: doorWY };

    for (let gy = 0; gy < TAVERN_ROWS; gy++) {
      for (let gx = 0; gx < TAVERN_COLS; gx++) {
        const wx = gx * TILE_SIZE + TILE_SIZE / 2, wy = gy * TILE_SIZE + TILE_SIZE / 2;
        const p = worldToScreen(wx, wy);
        const isDoor = gx === TAVERN_DOOR_TILE[0] && gy === TAVERN_DOOR_TILE[1];
        const key = isDoor ? 'tavern_door_mark' : ((gx + gy) % 2 === 0 ? 'tavern_floor_a' : 'tavern_floor_b');
        this.add.image(p.x, p.y, key).setOrigin(0.5, 0.5).setDepth(0);
      }
    }

    // Pared del fondo: una imagen alta por columna, anclada en la base
    // como los árboles/ruinas de fuera, con la chimenea en el centro.
    for (let gx = 0; gx < TAVERN_COLS; gx++) {
      const wx = gx * TILE_SIZE + TILE_SIZE / 2, wy = TAVERN_WALL_ROW * TILE_SIZE + TILE_SIZE;
      const p = worldToScreen(wx, wy);
      const key = gx === TAVERN_FIREPLACE_COL ? 'tavern_wall_fireplace' : 'tavern_wall';
      this.add.image(p.x, p.y, key).setOrigin(0.5, 1).setDepth(500);
    }
  }

  buildFurniture() {
    const bar = TAVERN_BAR_SPOTS.map(([gx, gy, radius]) => this.placeProp(gx, gy, 'tavern_bar', radius, 0.8));
    const tables = TAVERN_TABLE_SPOTS.map(([gx, gy]) => this.placeProp(gx, gy, 'tavern_table', 22, 0.85));
    const barrels = TAVERN_BARREL_SPOTS.map(([gx, gy]) => this.placeProp(gx, gy, 'tavern_barrel', 16, 0.92));
    this.obstacles = bar.concat(tables, barrels);
  }

  placeProp(gx, gy, texture, radius, originY) {
    const wx = gx * TILE_SIZE + TILE_SIZE / 2, wy = gy * TILE_SIZE + TILE_SIZE / 2;
    const p = worldToScreen(wx, wy);
    const img = this.add.image(p.x, p.y, texture).setOrigin(0.5, originY);
    img.setDepth(1000 + p.y);
    return { worldX: wx, worldY: wy, radius };
  }

  buildPlayer() {
    // Un par de filas por encima de la puerta: para salir hay que
    // caminar hasta ella a propósito, no basta con aparecer ya encima.
    this.worldX = TAVERN_DOOR_TILE[0] * TILE_SIZE + TILE_SIZE / 2;
    this.worldY = (TAVERN_DOOR_TILE[1] - 2) * TILE_SIZE + TILE_SIZE / 2;
    const p = worldToScreen(this.worldX, this.worldY);
    this.player = this.add.sprite(p.x, p.y, 'player').setOrigin(0.5, 0.9);
    this.player.setDepth(1000 + p.y);
  }

  buildHud() {
    this.add.text(14, 12, '🍺 La Taberna del Cuervo', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#f4c430', stroke: '#000000', strokeThickness: 4
    }).setScrollFactor(0).setDepth(999999);

    const menuBtn = this.add.text(this.scale.width - 14, 12, '☰ Menú', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 4
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(999999).setInteractive({ useHandCursor: true });
    menuBtn.on('pointerdown', () => isoBackToMenu());

    const exitBtn = this.add.text(this.scale.width - 14, 40, '🚪 Salir de la taberna', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#ffe066', stroke: '#000000', strokeThickness: 4
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(999999).setInteractive({ useHandCursor: true });
    exitBtn.on('pointerdown', () => this.exitTavern());
  }

  collidesObstacle(x, y) {
    return this.obstacles.some(o => Phaser.Math.Distance.Between(x, y, o.worldX, o.worldY) < (PLAYER_RADIUS + o.radius));
  }

  // La fila 0 (la pared del fondo) bloquea entera, igual que el río de
  // fuera bloquea por casilla completa en vez de por círculo.
  blockedByWall(x, y) {
    return Math.floor(y / TILE_SIZE) === TAVERN_WALL_ROW;
  }

  tryMoveAxis(dx, dy) {
    const roomW = TAVERN_COLS * TILE_SIZE, roomH = TAVERN_ROWS * TILE_SIZE;
    const nx = Phaser.Math.Clamp(this.worldX + dx, PLAYER_RADIUS, roomW - PLAYER_RADIUS);
    const ny = Phaser.Math.Clamp(this.worldY + dy, PLAYER_RADIUS, roomH - PLAYER_RADIUS);
    if (this.collidesObstacle(nx, ny) || this.blockedByWall(nx, ny)) return;
    this.worldX = nx; this.worldY = ny;
  }

  exitTavern() {
    if (this.exiting) return;
    this.exiting = true;
    this.scene.start('GameScene', { mode: 'solo', resumeAt: this.returnAt });
  }

  update() {
    if (this.exiting) return;
    const dt = this.game.loop.delta / 1000;

    let ix = 0, iy = 0;
    if (this.cursors.left.isDown || this.keys.a.isDown) ix -= 1;
    if (this.cursors.right.isDown || this.keys.d.isDown) ix += 1;
    if (this.cursors.up.isDown || this.keys.w.isDown) iy -= 1;
    if (this.cursors.down.isDown || this.keys.s.isDown) iy += 1;
    const kbLen = Math.hypot(ix, iy);
    if (kbLen > 0) { ix /= kbLen; iy /= kbLen; }

    let magnitude = kbLen > 0 ? 1 : 0;
    if (window.isoJoystick.active) {
      ix = window.isoJoystick.dx;
      iy = window.isoJoystick.dy;
      magnitude = Math.min(1, Math.hypot(ix, iy));
    }

    if (magnitude > 0.001) {
      const len = Math.hypot(ix, iy) || 1;
      const speed = PLAYER_SPEED * magnitude * dt;
      this.tryMoveAxis((ix / len) * speed, 0);
      this.tryMoveAxis(0, (iy / len) * speed);
      if (Math.abs(ix) > 0.1) this.player.setFlipX(ix < 0);

      const p = worldToScreen(this.worldX, this.worldY);
      this.player.setPosition(p.x, p.y);
      this.player.setDepth(1000 + p.y);

      if (Phaser.Math.Distance.Between(this.worldX, this.worldY, this.doorSpot.worldX, this.doorSpot.worldY) < TAVERN_EXIT_RADIUS) {
        this.exitTavern();
      }
    }
  }
}
