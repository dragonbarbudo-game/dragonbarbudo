/* =========================
   BootScene — carga (o, por ahora, genera) los assets del juego
   -------------------------------------------------------------
   Todavía no hay arte final (ver README.md), así que en vez de
   this.load.image(...) esta escena DIBUJA las texturas a mano con
   Phaser.Graphics: formas planas, colores saturados y contorno grueso.

   ESTILO GÓTICO (v4): el usuario mandó una escena de referencia
   (catedral/cementerio nocturno, morados y grises fríos con ventanas
   en dorado cálido) y pidió ese tono para TODO el juego, no solo para
   una zona — de ahí la paleta oscura de esta escena (antes era un
   cartoon verde brillante). GOTHIC_PALETTE centraliza los colores para
   no repetirlos sueltos por todo el archivo.

   Cuando lleguen imágenes reales:
     1) Pon los ficheros en assets/tiles/ y assets/sprites/.
     2) Sustituye buildPlaceholderTextures() por this.load.image(key,
        'assets/tiles/xxx.png') / this.load.spritesheet(...) dentro de
        preload().
     3) Las claves de textura las usa GameScene/TavernScene tal cual —
        no hace falta tocar nada más si mantienes los mismos nombres.
        Ojo: las losas de suelo son RECTÁNGULOS (TILE_SIZE x
        TILE_SIZE*ISO_SQUISH), no rombos — si tu arte real es cuadrado
        de verdad, ajusta ISO_SQUISH en config.js o genera la imagen ya
        con esa proporción.
========================= */
const GOTHIC_PALETTE = {
  stoneLight: 0x3a3550,
  stoneDark: 0x332d45,
  mortar: 0x221e30,
  path: 0x4a4458,
  pathDark: 0x3d3849,
  water: 0x1c2338,
  waterGlow: 0x5a6b9a,
  foliage: 0x232f1f,
  foliageDark: 0x1a2417,
  trunk: 0x1a140f,
  ruinLight: 0x8b8489,
  ruinMid: 0x6f6a6c,
  ruinDark: 0x5f5a5d,
  wood: 0x4a3728,
  woodDark: 0x36271b,
  woodLight: 0x5c4530,
  metal: 0x6c6672,
  glow: 0xffb347,
  glowSoft: 0xf4c430,
  cloak: 0x34355e,
  cloakDark: 0x262740,
  skin: 0xd9c3a8
};

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
    const P = GOTHIC_PALETTE;
    const tileH = Math.round(TILE_SIZE * ISO_SQUISH);

    // Losas del suelo exterior: piedra fría en dos tonos, con línea de
    // "mortero" marcando la cuadrícula.
    const tileColors = { a: P.stoneLight, b: P.stoneDark };
    Object.keys(tileColors).forEach((key) => {
      g.clear();
      g.fillStyle(tileColors[key], 1);
      g.fillRect(0, 0, TILE_SIZE, tileH);
      g.lineStyle(2, P.mortar, 0.5);
      g.strokeRect(1, 1, TILE_SIZE - 2, tileH - 2);
      g.generateTexture('tile_' + key, TILE_SIZE, tileH);
    });

    // Jugador (48x64): capa oscura en vez del azul brillante anterior,
    // ojos claros para que se lea bien contra fondos oscuros.
    g.clear();
    g.fillStyle(0x000000, 0.35); g.fillEllipse(24, 58, 34, 13);
    g.fillStyle(P.cloak, 1); g.fillRoundedRect(8, 12, 32, 40, 13);
    g.fillStyle(P.skin, 1); g.fillCircle(18, 26, 4.5); g.fillCircle(30, 26, 4.5);
    g.fillStyle(0x141018, 1); g.fillCircle(19, 26, 2); g.fillCircle(31, 26, 2);
    g.lineStyle(3, 0x0c0a12, 1); g.strokeRoundedRect(8, 12, 32, 40, 13);
    g.generateTexture('player', 48, 64);

    // Moneda (32x32): se queda dorada a propósito — es el único acento
    // cálido que "brilla" en un mundo frío, igual que las ventanas de
    // la escena de referencia.
    g.clear();
    g.fillStyle(0x000000, 0.3); g.fillEllipse(16, 27, 18, 7);
    g.fillStyle(P.glowSoft, 1); g.fillCircle(16, 15, 12);
    g.fillStyle(P.glow, 1); g.fillCircle(13, 12, 5);
    g.lineStyle(2, 0x8a5e00, 1); g.strokeCircle(16, 15, 12);
    g.generateTexture('coin', 32, 32);

    // Árbol (56x84): silueta oscura y retorcida en vez del verde vivo.
    g.clear();
    g.fillStyle(0x000000, 0.35); g.fillEllipse(28, 76, 38, 13);
    g.fillStyle(P.trunk, 1); g.fillRect(24, 46, 8, 28);
    g.fillStyle(P.foliage, 1); g.fillCircle(28, 30, 26); g.fillCircle(11, 42, 16); g.fillCircle(45, 42, 16);
    g.lineStyle(3, P.foliageDark, 1); g.strokeCircle(28, 30, 26);
    g.generateTexture('tree', 56, 84);

    // --- Zona: Camino de las Ruinas ---

    g.clear();
    g.fillStyle(P.path, 1); g.fillRect(0, 0, TILE_SIZE, tileH);
    g.fillStyle(P.pathDark, 0.6); g.fillCircle(20, tileH * 0.4, 7); g.fillCircle(55, tileH * 0.65, 6);
    g.lineStyle(2, P.mortar, 0.4); g.strokeRect(1, 1, TILE_SIZE - 2, tileH - 2);
    g.generateTexture('tile_path', TILE_SIZE, tileH);

    // Agua: azul-negro profundo con un brillo frío (mismo tono que las
    // ventanas iluminadas de la referencia, #5a6b9a) en vez del celeste
    // vivo anterior.
    g.clear();
    g.fillStyle(P.water, 1); g.fillRect(0, 0, TILE_SIZE, tileH);
    g.lineStyle(1.5, P.waterGlow, 0.35);
    g.strokeEllipse(TILE_SIZE * 0.3, tileH * 0.3, 22, 6); g.strokeEllipse(TILE_SIZE * 0.65, tileH * 0.6, 26, 6);
    g.generateTexture('water', TILE_SIZE, tileH);

    // Ruina (52x70): ya era piedra gris, se queda casi igual (encaja
    // bien con la referencia tal cual).
    g.clear();
    g.fillStyle(0x000000, 0.3); g.fillEllipse(26, 62, 34, 12);
    g.fillStyle(P.ruinLight, 1); g.fillRect(4, 22, 44, 40);
    g.fillStyle(P.ruinMid, 1); g.fillRect(4, 22, 44, 10);
    g.fillStyle(0x000000, 0.25); g.fillTriangle(30, 22, 44, 22, 44, 40); // esquina rota
    g.lineStyle(3, P.ruinDark, 1); g.strokeRect(4, 22, 44, 40);
    g.generateTexture('ruin', 52, 70);

    // Edificio de la taberna, visto desde fuera (72x116): pared de
    // piedra, tejado oscuro a dos aguas, una ventana encendida en cálido
    // (el acento dorado de la referencia) y un hueco de puerta más
    // oscuro en la base — es la casilla exacta que hace de entrada
    // (ver TAVERN_DOOR_SPOT en GameScene).
    g.clear();
    g.fillStyle(0x000000, 0.35); g.fillEllipse(36, 110, 50, 14);
    g.fillStyle(P.stoneDark, 1); g.fillRect(6, 46, 60, 64);
    g.fillStyle(0x1c1926, 1); g.fillTriangle(0, 46, 36, 6, 72, 46); // tejado
    g.lineStyle(2, P.mortar, 0.7); g.strokeRect(6, 46, 60, 64);
    g.fillStyle(P.glow, 0.9); g.fillRect(40, 58, 14, 16); // ventana encendida
    g.lineStyle(2, 0x0c0a12, 1); g.strokeRect(40, 58, 14, 16);
    g.fillStyle(0x0c0a12, 1); g.fillRect(18, 84, 16, 26); // hueco de la puerta
    g.generateTexture('tavern_building', 72, 116);

    // --- Interior de la taberna ---

    // Suelo de madera (dos tonos, mismo tamaño que las losas de fuera).
    const floorColors = { a: P.wood, b: P.woodDark };
    Object.keys(floorColors).forEach((key) => {
      g.clear();
      g.fillStyle(floorColors[key], 1);
      g.fillRect(0, 0, TILE_SIZE, tileH);
      g.lineStyle(1.5, 0x000000, 0.25);
      g.lineBetween(0, tileH * 0.5, TILE_SIZE, tileH * 0.5);
      g.strokeRect(1, 1, TILE_SIZE - 2, tileH - 2);
      g.generateTexture('tavern_floor_' + key, TILE_SIZE, tileH);
    });

    // Pared del fondo (decorativa, ancla en su base como un árbol): un
    // tramo de muro con una chimenea encendida en el centro.
    g.clear();
    g.fillStyle(P.stoneDark, 1); g.fillRect(0, 0, TILE_SIZE, 100);
    g.lineStyle(1.5, P.mortar, 0.6); g.strokeRect(0, 0, TILE_SIZE, 100);
    g.generateTexture('tavern_wall', TILE_SIZE, 100);

    g.clear();
    g.fillStyle(P.stoneDark, 1); g.fillRect(0, 0, TILE_SIZE, 100);
    g.lineStyle(1.5, P.mortar, 0.6); g.strokeRect(0, 0, TILE_SIZE, 100);
    g.fillStyle(0x1c1420, 1); g.fillRect(16, 40, TILE_SIZE - 32, 60); // hueco de la chimenea
    g.fillStyle(P.glow, 1); g.fillCircle(TILE_SIZE / 2, 82, 12); // fuego
    g.fillStyle(P.glowSoft, 1); g.fillCircle(TILE_SIZE / 2, 82, 6);
    g.generateTexture('tavern_wall_fireplace', TILE_SIZE, 100);

    // Barra de la taberna (110x50): prop con colisión, madera oscura con
    // tablero superior más claro y un candil.
    g.clear();
    g.fillStyle(0x000000, 0.3); g.fillEllipse(55, 46, 90, 12);
    g.fillStyle(P.woodDark, 1); g.fillRect(0, 14, 110, 32);
    g.fillStyle(P.woodLight, 1); g.fillRect(0, 10, 110, 8);
    g.fillStyle(P.glow, 1); g.fillCircle(90, 6, 4);
    g.lineStyle(2, 0x1f150e, 1); g.strokeRect(0, 14, 110, 32);
    g.generateTexture('tavern_bar', 110, 50);

    // Mesa redonda (48x40) con dos taburetes insinuados a los lados.
    g.clear();
    g.fillStyle(0x000000, 0.3); g.fillEllipse(24, 34, 40, 10);
    g.fillStyle(P.wood, 1); g.fillEllipse(24, 20, 40, 16);
    g.fillStyle(P.woodLight, 1); g.fillEllipse(24, 16, 40, 14);
    g.fillStyle(P.woodDark, 1); g.fillRect(20, 22, 8, 12);
    g.generateTexture('tavern_table', 48, 40);

    // Barril (32x40).
    g.clear();
    g.fillStyle(0x000000, 0.3); g.fillEllipse(16, 37, 22, 6);
    g.fillStyle(P.wood, 1); g.fillRoundedRect(2, 6, 28, 30, 10);
    g.lineStyle(2, P.metal, 1); g.strokeRoundedRect(2, 6, 28, 30, 10);
    g.lineStyle(1.5, P.metal, 0.8); g.lineBetween(2, 14, 30, 14); g.lineBetween(2, 28, 30, 28);
    g.generateTexture('tavern_barrel', 32, 40);

    // Marca de la puerta en el suelo (una losa distinta, más clara):
    // pisarla es lo que saca al jugador de la taberna.
    g.clear();
    g.fillStyle(P.glow, 0.5); g.fillRect(0, 0, TILE_SIZE, tileH);
    g.lineStyle(2, P.glow, 0.9); g.strokeRect(2, 2, TILE_SIZE - 4, tileH - 4);
    g.generateTexture('tavern_door_mark', TILE_SIZE, tileH);

    g.destroy();
  }
}
