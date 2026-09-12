# El Caballero Errante — Concepto del mapa

Mini-documento de concepto pedido en `dragonbarbudo-demo-isometrico-prompt.md` (sección "Siguiente tarea"), con las decisiones ya confirmadas con el usuario. Todavía no toca código del mapa final — esto es la base para diseñarlo.

## Tema y ambientación

**Reino de fantasía medieval.** Encaja con el nombre del juego y con el resto de Dragonbarbudo (dragones, la Aventura con GM IA, tipografía Cinzel). El claro de bosque que ya existe (árboles, hierba en dos tonos) es el punto de partida visual: se mantiene y se amplía, no se sustituye.

Identidad visual a mantener según se añadan zonas: colores saturados y contorno negro grueso (ya establecido), caminos de tierra conectando zonas, ruinas de piedra, una aldea lejana, y un castillo en el horizonte como referencia visual a largo plazo (no necesariamente explorable pronto — sirve para dar sensación de mundo más grande de lo que se puede pisar todavía).

## Escala: un único mapa que crece

No hay "Misión 1", "Misión 2" ni mapas separados que desbloquear. Es **un solo mundo continuo** que se amplía con el tiempo (más zonas más lejos del claro inicial), no una serie de niveles independientes.

Esto tiene una consecuencia técnica importante para cuando se amplíe `GameScene.js`:

- `GRID_SIZE`/`MAP_SIZE` puede crecer sin más (12x12 → lo que haga falta): las coordenadas de mundo ya existentes (jugador, árboles, monedas) siguen siendo válidas, solo hay más mapa alrededor.
- `COIN_SPOTS`/`TREE_SPOTS` (arrays en `GameScene.js`) deben crecer **añadiendo al final**, nunca insertando ni reordenando en medio — el guardado en solitario referencia las monedas recogidas por su índice en el array (`collectedIndexes`), así que reordenar invalidaría partidas guardadas de gente que ya estaba jugando.
- No hace falta ninguna migración de guardado al ampliar el mapa: una partida guardada con el mapa pequeño se seguiría restaurando bien en el mapa grande (el jugador simplemente aparece en la misma zona de siempre, ahora con más mundo alrededor por explorar).

## Zonas propuestas (por orden de expansión)

1. **Claro del Bosque** _(ya existe)_ — punto de partida, zona fácil/tutorial. 6 árboles, 5 monedas.
2. **Camino de las Ruinas** — un sendero desde el claro hacia unas ruinas de piedra; más obstáculos (rocas, muros caídos), quizá un río estrecho que rodear.
3. **Aldea de los Viajeros** — un pequeño pueblo (casas como decoración por ahora, sin entrar dentro); punto de encuentro natural para partidas con amigos.
4. **Castillo del Horizonte** — visible desde lejos como telón de fondo desde el principio (aunque no sea accesible todavía); referencia visual de que el mundo sigue más allá de lo jugable.

Cada zona nueva añade sus propias monedas y obstáculos a los arrays existentes (ver arriba), sin tocar las zonas anteriores.

## Guardado: sigue en local por ahora

No se crea la tabla `game_saves` en Supabase todavía. Con un solo mapa continuo (no varias partidas/niveles distintos que rastrear), el guardado en `localStorage` ya cubre bien el caso de uso — pasar a la nube tendría sentido más adelante si:

- Se quiere que el progreso siga al jugador entre dispositivos (móvil ↔ PC), o
- Aparecen varios juegos/mapas del portal que conviene sincronizar desde un mismo sitio.

Ninguna de las dos cosas es el caso ahora mismo, así que se pospone conscientemente en vez de construirlo sin necesidad clara.

## Siguiente paso

Con este concepto confirmado, la siguiente tarea de construcción sería la **Zona 2 (Camino de las Ruinas)**: ampliar `TREE_SPOTS`/`COIN_SPOTS`/`MAP_SIZE` en `games/demo-isometrico/src/scenes/GameScene.js` y `config.js`, más las texturas nuevas (roca de ruina, río) en `BootScene.js`. Se confirmará el diseño exacto de esa zona (tamaño, cuántos obstáculos/monedas, dónde queda el río) antes de tocar código, igual que aquí.
