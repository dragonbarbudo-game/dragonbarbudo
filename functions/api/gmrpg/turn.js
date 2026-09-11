// Cloudflare Pages Function: resuelve un turno de la Aventura con Game
// Master IA (modo solo, Fase 1). El navegador nunca ve la API key de
// Anthropic — solo esta Function la usa, igual que las funciones de
// admin usan SUPABASE_SERVICE_ROLE_KEY sin exponerla nunca al cliente.
//
// El cliente manda el JSON de estado de la partida + la acción del
// jugador (o una tirada ya resuelta, ver gmrpgRollDice en index.html);
// esta Function llama al modelo con el system prompt fijo de la
// aventura, separa NARRACIÓN de ESTADO en la respuesta, y devuelve
// ambos. El cliente es quien guarda el resultado en Supabase
// (gmrpg_games) — esta Function no toca la base de datos.
//
// Variable de entorno nueva (añadir en Cloudflare Pages → Settings →
// Environment variables): ANTHROPIC_API_KEY

const SUPABASE_URL = 'https://yptdxphximblpzlrgjpg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdGR4cGh4aW1ibHB6bHJnanBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MTI2ODIsImV4cCI6MjEwNDA4ODY4Mn0.aA2jm-SC6xRI1_klg-17M-Po81RZP6dnpDfRBDQq_gc';

const ANTHROPIC_MODEL = 'claude-sonnet-5';
const ANTHROPIC_MAX_TOKENS = 600;
const ANTHROPIC_MAX_TOKENS_GRUPO = 900; // resolver 2-4 personajes a la vez necesita más espacio de respuesta
const ACCION_MAX_LEN = 500;

// Escenario fijo del MVP (Fase 1): una sola aventura preescrita. Vive
// aquí, no en el cliente, para poder cambiarla sin tocar index.html.
const LISTA_RAZAS = 'Humano, Elfo, Enano, Orco, Trasgo';
const TURNOS_MAX = 12;
const TONO = 'Aventurero, con humor ligero, nunca oscuro ni grimdark. Apto para todos los públicos.';
const CONDICION_VICTORIA = 'recuperar la reliquia robada y volver con ella a la taberna de Dragonbarbudo';
const CONDICION_DERROTA = 'la vida del personaje llega a 0 durante el combate final, o se agotan los 12 turnos sin recuperar la reliquia';
const PREMISA = 'Una banda de trasgos ha robado una reliquia de la taberna de Dragonbarbudo durante la noche y ha huido hacia unas ruinas cercanas. El personaje sale tras ellos para recuperarla.';

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Fase 2: añadido de grupo (docs/modo-multijugador-bots.md). En modo
// grupo el JSON de estado trae "grupo" (array de personajes) y
// "orden_turno" en vez de un único "personaje"; el GM nunca pide
// tiradas (no hay margen para un ida-y-vuelta a mitad de ronda), solo
// narra sobre las que cada jugador ya resolvió por su cuenta.
const MODO_GRUPO_ADENDA = `

## Modo grupo (2-4 personajes)
Esta partida es de grupo: en vez de "personaje", el JSON de estado trae "grupo" (un array, un personaje por entrada, cada uno con su propio nombre/raza/vida/vida_max/atributos/inventario) y "orden_turno" (el orden fijo en que actúan). Cada ronda recibes la acción de TODOS los personajes de la lista, en ese mismo orden, bajo "Acciones de esta ronda". Resuelve cada acción para el personaje al que corresponde y actualiza su vida/atributos/inventario dentro del array "grupo" — nunca un único personaje.

En este modo NUNCA pidas una tirada ("Tira 1d6..."): cada jugador decide de antemano si su acción necesita tirada y, si la necesita, ya viene marcada con un bloque "[TIRADA] atributo=... dado=... total=... banda=... natural=..." al final de su texto — narra sobre ese resultado ya resuelto, no lo repitas ni lo contradigas. Si una acción NO trae ese bloque, resuélvela de forma narrativa sin banda numérica: ni fallo ni éxito total "porque sí", algo intermedio y razonable según lo que describa el jugador.

Derrota de grupo: fuera del combate final, un personaje a 0 de vida queda "fuera de combate" un instante y vuelve a 1 (igual que en modo solo). Durante el combate final, si TODOS los personajes vivos del grupo llegan a 0 de vida, es derrota para el grupo entero: cierra con "resultado":"derrota". Si solo caen algunos y otros siguen en pie, la aventura continúa para el grupo.`;

function buildSystemPrompt(modo) {
  return `Eres el Game Master de una partida de rol corta dentro de Dragonbarbudo, un mundo de fantasía con razas jugables (${LISTA_RAZAS}). Narras, controlas enemigos y resuelves acciones — nunca decides por el jugador.

## Premisa de esta aventura
${PREMISA}

## Duración y ritmo
La partida debe cerrarse en un máximo de ${TURNOS_MAX} turnos. Llevas la cuenta en el campo "turno" del estado.

Reparto orientativo de turnos:
1. Turnos 1-2: apertura y contexto, sin tirada.
2. Turnos 3-6: exploración o interacción social, con alguna tirada suelta.
3. Turnos 7-9: primer combate (2-4 rondas con tirada).
4. Turno 10: giro o complicación hacia el desenlace.
5. Turnos 11-12: combate final o decisión clave, y cierre.

No sigas esto de forma rígida: si vas tarde, fuerza el combate o salta al clímax antes de agotar los turnos.

## Formato de cada respuesta
Responde SIEMPRE con dos bloques, en este orden y nada más:
NARRACIÓN: 2-4 frases máximo, directas, con ritmo.
ESTADO: JSON actualizado con el mismo esquema que recibes.
No incluyas nada más. No expliques tu razonamiento ni comentes las reglas.

## Resolución de acciones (mecánica de dados)
Los atributos van de 0 a 2. Cuando haya riesgo real, pide textualmente: "Tira 1d6 + [atributo]" (usa ese formato exacto, con el nombre del atributo en minúsculas). Espera siempre el número que te pase el jugador — nunca lo inventes tú. El jugador puede mandarte una acción marcada como "[TIRADA]" con el dado, el atributo, el total y la banda ya calculados: tómalos como un hecho ya ocurrido y narra sobre ese resultado, no lo recalcules ni lo contradigas.

Bandas de resultado (total = dado + atributo):
- 1-3: fallo con complicación
- 4-5: éxito parcial con coste
- 6-8: éxito total

Naturales especiales (sobre el dado en crudo, antes de sumar el atributo):
- 6 natural: beneficio extra (o +1 de daño en combate).
- 1 natural: complicación extra, incluso si el total es alto (o +1 de daño recibido en combate).

Ventaja/desventaja: en vez de modificadores sueltos, cuando la situación favorezca o perjudique claramente al jugador, pide tirada de 2d6 quedándose con el más alto (ventaja) o el más bajo (desventaja). Anúncialo antes de tirar. Nunca se acumulan ambas.

Acciones sin riesgo real (moverse, hablar, mirar) se narran directamente, sin tirada.

Registra cada tirada en "ultima_tirada" del JSON de estado.

## Combate
Usa la misma tirada, sin sistema de daño aparte:
- Fallo: el enemigo golpea, el personaje pierde 1 de vida.
- Éxito parcial: el personaje hace 1 de daño, pero pierde 1 de vida o un recurso.
- Éxito total: el personaje hace 2 de daño, sin coste.
Aplica el ±1 extra de los naturales 6/1 al daño correspondiente.

## Vida y derrota
- Si la vida del personaje llega a 0 fuera del combate final (mapa.combate_final = false): NO muere. Queda "fuera de combate" un instante — narra una complicación (pierde el objeto, el enemigo huye, se retira herido) y su vida vuelve a 1. La partida continúa.
- Si la vida llega a 0 durante el combate final (mapa.combate_final = true): es derrota. Cierra con "resultado": "derrota".
- Marca "mapa.combate_final": true en cuanto empiece el enfrentamiento o decisión que vaya a cerrar la partida.

## Reglas no negociables
- El jugador decide las acciones de su personaje. Tú controlas el mundo, NPCs y enemigos.
- No introduzcas enemigos, objetos o salas que no estén en "estado.mapa" salvo que sea tu turno de generar contenido nuevo — y en ese caso, añádelo al JSON.
- Ajusta la dificultad de forma dinámica: bajarla tras fallos encadenados, subirla tras éxitos encadenados.

## Tono
${TONO}

## Victoria, derrota y recompensas
- Victoria si ${CONDICION_VICTORIA}.
- Derrota si ${CONDICION_DERROTA}.
- Al terminar, sustituye NARRACIÓN por un cierre de 1-2 frases, y en el JSON añade "resultado": "victoria" | "derrota".${modo === 'grupo' ? MODO_GRUPO_ADENDA : ''}`;
}

// Separa el bloque NARRACIÓN del bloque ESTADO en el texto crudo que
// devuelve el modelo. Tolerante con variaciones de formato (números,
// mayúsculas, espacios) porque un LLM no siempre es 100% consistente.
function parseModelReply(text) {
  const estadoIdx = text.search(/ESTADO\s*:/i);
  if (estadoIdx === -1) throw new Error('sin_bloque_estado');

  let narracion = text.slice(0, estadoIdx);
  narracion = narracion.replace(/^.*?NARRACI[ÓO]N\s*:?\s*/is, '').trim();

  const jsonPart = text.slice(estadoIdx);
  const firstBrace = jsonPart.indexOf('{');
  const lastBrace = jsonPart.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) throw new Error('sin_json_estado');

  const estado = JSON.parse(jsonPart.slice(firstBrace, lastBrace + 1));
  return { narracion, estado };
}

export async function onRequestPost(context) {
  // Siempre respondemos con status 200 (el resultado real va en "ok"):
  // Cloudflare sustituye cualquier respuesta 5xx de una Function por su
  // propia página de error genérica, ocultando el motivo real del fallo.
  try {
    const { request, env } = context;
    if (!env.ANTHROPIC_API_KEY) return json({ ok: false, error: 'missing_config' }, 200);

    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return json({ ok: false, error: 'missing_params' }, 200);

    // ¿Quién llama? Nunca nos fiamos de nada que mande el cliente sin
    // verificar: solo alguien con sesión de verdad puede gastar créditos
    // de la API llamando a esta Function.
    const meResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: authHeader }
    });
    if (!meResp.ok) return json({ ok: false, error: 'invalid_session' }, 200);

    const { modo, estado, accion, acciones } = await request.json().catch(() => ({}));
    const modoSeguro = modo === 'grupo' ? 'grupo' : 'solo';
    if (!estado || typeof estado !== 'object') return json({ ok: false, error: 'missing_params' }, 200);
    if (typeof estado.turno !== 'number' || typeof estado.turno_max !== 'number') {
      return json({ ok: false, error: 'missing_params' }, 200);
    }
    if (estado.turno > estado.turno_max) return json({ ok: false, error: 'partida_terminada' }, 200);

    // No mandamos "historial" (ni el resto de campos de recolección de
    // turno, que ya no hacen falta una vez armado el mensaje) al
    // modelo: no lo necesita —la spec pide que el JSON de estado sea
    // su única memoria— y así se ahorran tokens en cada turno.
    const { historial, orden_turno, acciones_ronda, turno_actual, ...estadoParaModelo } = estado;

    let mensaje;
    if (modoSeguro === 'grupo') {
      if (!Array.isArray(estado.grupo) || !Array.isArray(orden_turno) || !acciones || typeof acciones !== 'object') {
        return json({ ok: false, error: 'missing_params' }, 200);
      }
      const nombrePorId = {};
      estado.grupo.forEach(p => { if (p && p.id) nombrePorId[p.id] = p.nombre || p.id; });
      const lineasAcciones = orden_turno.map(id => {
        const texto = String(acciones[id] || '(no ha hecho nada esta ronda)').slice(0, ACCION_MAX_LEN);
        return `- ${nombrePorId[id] || id}: "${texto}"`;
      }).join('\n');
      mensaje = `Estado actual (JSON):\n${JSON.stringify(estadoParaModelo)}\n\nAcciones de esta ronda:\n${lineasAcciones}`;
    } else {
      const accionSegura = String(accion || '').slice(0, ACCION_MAX_LEN);
      mensaje = `Estado actual (JSON):\n${JSON.stringify(estadoParaModelo)}\n\nAcción del jugador: "${accionSegura}"`;
    }

    const apiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: modoSeguro === 'grupo' ? ANTHROPIC_MAX_TOKENS_GRUPO : ANTHROPIC_MAX_TOKENS,
        system: buildSystemPrompt(modoSeguro),
        messages: [{ role: 'user', content: mensaje }]
      })
    });

    if (!apiResp.ok) {
      const detail = await apiResp.text().catch(() => '');
      return json({ ok: false, error: 'llm_failed', status: apiResp.status, detail }, 200);
    }

    const apiBody = await apiResp.json();
    const rawText = (apiBody.content || []).map(b => b.text || '').join('').trim();
    if (!rawText) return json({ ok: false, error: 'respuesta_vacia' }, 200);

    let parsed;
    try {
      parsed = parseModelReply(rawText);
    } catch (e) {
      return json({ ok: false, error: 'respuesta_invalida' }, 200);
    }

    return json({ ok: true, narracion: parsed.narracion, estado: parsed.estado }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
}
