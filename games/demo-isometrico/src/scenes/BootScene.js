/* =========================
   BootScene — carga (o, por ahora, genera) los assets del juego
   -------------------------------------------------------------
   Todavía no hay arte final (ver README.md), así que en vez de
   this.load.image(...) esta escena DIBUJA las texturas a mano con
   Phaser.Graphics: formas planas, colores saturados y contorno grueso.
   Cuando lleguen imágenes reales:
     1) Pon los ficheros en assets/tiles/ y assets/sprites/.
     2) Sustituye buildPlaceholderTextures() por this.load.image(key,
        'assets/tiles/xxx.png') / this.load.spritesheet(...) dentro de
        preload().
     3) Las claves de textura ('tile_a', 'tile_b', 'tile_path', 'water',
        'player', 'coin', 'tree', 'ruin') las usa GameScene tal cual —
        no hace falta tocar nada más si mantienes los mismos nombres.
        Ojo: las losas de suelo son RECTÁNGULOS (TILE_SIZE x
        TILE_SIZE*ISO_SQUISH), no rombos — si tu arte real es cuadrado
        de verdad, ajusta ISO_SQUISH en config.js o genera la imagen ya
        con esa proporción.
========================= */
class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  init(data) {
    // Datos de arranque que pasó main.js (isoLaunch): modo solo/con
    // amigos, partida guardada a restaurar, matchId si hay amigo, etc.
    // Se limita a reenviarlos a GameScene — BootScene no los necesita.
    this.startData = data || {};
  }

  preload() {
    // Sin red que esperar (todo se genera en create), pero se deja el
    // hook de preload() ya escrito porque es donde irán los
    // this.load.image/spritesheet reales el día que haya arte.
  }

  create() {
    this.buildPlaceholderTextures();
    this.scene.start('GameScene', this.startData);
  }

  buildPlaceholderTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Losas del suelo: cuadradas (aplastadas solo en la textura, ver
    // ISO_SQUISH), dos tonos alternos para que se note la cuadrícula.
    const tileH = Math.round(TILE_SIZE * ISO_SQUISH);
    const tileColors = { a: 0x6bbf4f, b: 0x5fae44 };
    Object.keys(tileColors).forEach((key) => {
      g.clear();
      g.fillStyle(tileColors[key], 1);
      g.fillRect(0, 0, TILE_SIZE, tileH);
      g.lineStyle(2, 0x3f7a2f, 0.35);
      g.strokeRect(1, 1, TILE_SIZE - 2, tileH - 2);
      g.generateTexture('tile_' + key, TILE_SIZE, tileH);
    });

    // Jugador (48x64): sombra elíptica en la base (para que "pise" bien
    // el suelo) + cuerpo redondeado con cara sencilla. Textura normal,
    // sin aplastar — solo su posición se proyecta con worldToScreen.
    g.clear();
    g.fillStyle(0x000000, 0.25); g.fillEllipse(24, 58, 34, 13);
    g.fillStyle(0x2f6fd6, 1); g.fillRoundedRect(8, 12, 32, 40, 13);
    g.fillStyle(0xffffff, 1); g.fillCircle(18, 26, 4.5); g.fillCircle(30, 26, 4.5);
    g.fillStyle(0x1a1a1a, 1); g.fillCircle(19, 26, 2); g.fillCircle(31, 26, 2);
    g.lineStyle(3, 0x111318, 1); g.strokeRoundedRect(8, 12, 32, 40, 13);
    g.generateTexture('player', 48, 64);

    // Moneda (32x32): coleccionable con sombra + brillo.
    g.clear();
    g.fillStyle(0x000000, 0.2); g.fillEllipse(16, 27, 18, 7);
    g.fillStyle(0xf4c430, 1); g.fillCircle(16, 15, 12);
    g.fillStyle(0xffe066, 1); g.fillCircle(13, 12, 5);
    g.lineStyle(2, 0xaa7a00, 1); g.strokeCircle(16, 15, 12);
    g.generateTexture('coin', 32, 32);

    // Árbol (56x84): prop fijo, es el que demuestra el depth sorting —
    // el jugador debe verse delante o detrás de él según por dónde pase.
    g.clear();
    g.fillStyle(0x000000, 0.25); g.fillEllipse(28, 76, 38, 13);
    g.fillStyle(0x8b5a2b, 1); g.fillRect(24, 46, 8, 28);
    g.fillStyle(0x3f9b4a, 1); g.fillCircle(28, 30, 26); g.fillCircle(11, 42, 16); g.fillCircle(45, 42, 16);
    g.lineStyle(3, 0x1c3d1f, 1); g.strokeCircle(28, 30, 26);
    g.generateTexture('tree', 56, 84);

    // --- Zona 2: Camino de las Ruinas (ver prompts/dragonbarbudo-concepto-mapa.md) ---

    // Losa de camino de tierra: mismo tamaño que las de hierba, para
    // que encaje sin huecos en la misma cuadrícula.
    g.clear();
    g.fillStyle(0xab8a5e, 1); g.fillRect(0, 0, TILE_SIZE, tileH);
    g.fillStyle(0x9c7c50, 0.6); g.fillCircle(20, tileH * 0.4, 7); g.fillCircle(55, tileH * 0.65, 6);
    g.lineStyle(2, 0x7a6140, 0.4); g.strokeRect(1, 1, TILE_SIZE - 2, tileH - 2);
    g.generateTexture('tile_path', TILE_SIZE, tileH);

    // Losa de agua (río): también plana, para que se pueda "ver" desde
    // arriba como el resto del suelo — lo que la hace intransitable es
    // la lógica de GameScene (isWaterAt), no su aspecto.
    g.clear();
    g.fillStyle(0x2f6fb0, 1); g.fillRect(0, 0, TILE_SIZE, tileH);
    g.fillStyle(0x4a8bd6, 0.6); g.fillEllipse(TILE_SIZE * 0.3, tileH * 0.3, 22, 6); g.fillEllipse(TILE_SIZE * 0.65, tileH * 0.6, 26, 6);
    g.generateTexture('water', TILE_SIZE, tileH);

    // Ruina (52x70): bloque de piedra rota, prop fijo con colisión igual
    // que un árbol pero con su propio radio (RUIN_RADIUS).
    g.clear();
    g.fillStyle(0x000000, 0.25); g.fillEllipse(26, 62, 34, 12);
    g.fillStyle(0x8a8a86, 1); g.fillRect(4, 22, 44, 40);
    g.fillStyle(0x76766f, 1); g.fillRect(4, 22, 44, 10);
    g.fillStyle(0x000000, 0.2); g.fillTriangle(30, 22, 44, 22, 44, 40); // esquina rota
    g.lineStyle(3, 0x4d4d48, 1); g.strokeRect(4, 22, 44, 40);
    g.generateTexture('ruin', 52, 70);

    g.destroy();
  }
}
