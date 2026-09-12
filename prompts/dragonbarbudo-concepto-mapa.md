# El Caballero Errante — Concepto del mapa

Mini-documento de concepto pedido en `dragonbarbudo-demo-isometrico-prompt.md` (sección "Siguiente tarea"), con las decisiones ya confirmadas con el usuario. Todavía no toca código del mapa final — esto es la base para diseñarlo.

## Tema y ambientación

**Reino de fantasía medieval, en clave gótica y nocturna.** Encaja con el nombre del juego y con el resto de Dragonbarbudo (dragones, la Aventura con GM IA, tipografía Cinzel).

*Actualización:* el usuario mandó una escena de referencia (catedral/cementerio nocturno) y confirmó que ese tono es el de **todo el juego**, no de una zona suelta — así que la paleta pasó de un cartoon verde brillante a tonos fríos oscuros (morados/grises de piedra) con acentos cálidos puntuales (ventanas, monedas, fuego) como único color vivo, igual que en la referencia. `GOTHIC_PALETTE` en `BootScene.js` centraliza estos colores.

Identidad visual a mantener según se añadan zonas: piedra fría con líneas de mortero marcando la cuadrícula, caminos de tierra oscuros, ruinas de piedra, una aldea lejana, y un castillo en el horizonte como referencia visual a largo plazo (no necesariamente explorable pronto — sirve para dar sensación de mundo más grande de lo que se puede pisar todavía).

## Escala: un único mapa que crece

No hay "Misión 1", "Misión 2" ni mapas separados que desbloquear. Es **un solo mundo continuo** que se amplía con el tiempo (más zonas más lejos del claro inicial), no una serie de niveles independientes.

Esto tiene una consecuencia técnica importante para cuando se amplíe `GameScene.js`:

- `GRID_SIZE`/`MAP_SIZE` puede crecer sin más (12x12 → lo que haga falta): las coordenadas de mundo ya existentes (jugador, árboles, monedas) siguen siendo válidas, solo hay más mapa alrededor.
- `COIN_SPOTS`/`TREE_SPOTS` (arrays en `GameScene.js`) deben crecer **añadiendo al final**, nunca insertando ni reordenando en medio — el guardado en solitario referencia las monedas recogidas por su índice en el array (`collectedIndexes`), así que reordenar invalidaría partidas guardadas de gente que ya estaba jugando.
- No hace falta ninguna migración de guardado al ampliar el mapa: una partida guardada con el mapa pequeño se seguiría restaurando bien en el mapa grande (el jugador simplemente aparece en la misma zona de siempre, ahora con más mundo alrededor por explorar).

## Zonas (por orden; 1-3 ya construidas)

1. **Claro del Bosque** _(ya existe)_ — punto de partida, zona fácil/tutorial. 6 árboles, 5 monedas.
2. **La Taberna del Cuervo** _(ya existe)_ — la primera zona **interior**: un edificio en el Claro del Bosque que se puede entrar (acercarse basta) y que carga una escena cerrada aparte (`TavernScene.js`), con su propia ambientación (barra, mesas, barriles, chimenea). Salir exige una acción explícita — caminar hasta la puerta marcada en el suelo, o el botón "🚪 Salir de la taberna" — y te devuelve al exterior justo donde estaba la entrada. Solo en solitario por ahora (sincronizar una escena interior con un amigo en directo queda para más adelante).
3. **Camino de las Ruinas** _(ya existe)_ — un sendero desde el claro hacia unas ruinas de piedra, cruzando un río por un puente.
4. **Aldea de los Viajeros** — un pequeño pueblo (casas como decoración por ahora, sin entrar dentro, salvo quizás alguna otra interior como la taberna); punto de encuentro natural para partidas con amigos.
5. **Castillo del Horizonte** — visible desde lejos como telón de fondo desde el principio (aunque no sea accesible todavía); referencia visual de que el mundo sigue más allá de lo jugable.

Cada zona exterior nueva añade sus propias monedas y obstáculos a los arrays existentes (ver arriba), sin tocar las zonas anteriores. Las zonas **interiores** (como la taberna) son escenas de Phaser aparte, con su propio mundo pequeño y cerrado — no comparten `COIN_SPOTS`/`TREE_SPOTS` con el exterior.

## Guardado: sigue en local por ahora

No se crea la tabla `game_saves` en Supabase todavía. Con un solo mapa continuo (no varias partidas/niveles distintos que rastrear), el guardado en `localStorage` ya cubre bien el caso de uso — pasar a la nube tendría sentido más adelante si:

- Se quiere que el progreso siga al jugador entre dispositivos (móvil ↔ PC), o
- Aparecen varios juegos/mapas del portal que conviene sincronizar desde un mismo sitio.

Ninguna de las dos cosas es el caso ahora mismo, así que se pospone conscientemente en vez de construirlo sin necesidad clara.

## Siguiente paso

Con las Zonas 1-3 y el estilo gótico ya construidos, el siguiente paso natural es la **Zona 4 (Aldea de los Viajeros)**: casas exteriores (decorativas o, si se repite el patrón de la taberna, alguna otra interior visitable), y quizá el primer punto de encuentro pensado para partidas con amigos. Se confirmará el diseño exacto (tamaño, cuántas casas, cuáles son interiores) antes de tocar código, igual que aquí.
