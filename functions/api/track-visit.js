// Cloudflare Pages Function: registra una visita única por IP y día.
//
// La IP real del visitante llega en la cabecera CF-Connecting-IP, que
// pone el propio Cloudflare y no se puede falsear desde el navegador
// (a diferencia de una llamada hecha directamente desde el cliente a
// Supabase, donde cualquiera podría mentir sobre su IP). Nunca se
// guarda la IP en claro: se combina con una clave secreta
// (variable de entorno VISIT_IP_SALT) y se guarda solo su hash SHA-256,
// que no se puede revertir a la IP original.
//
// Variables de entorno necesarias (Cloudflare Pages → Settings →
// Environment variables), como secretos de producción:
//   SUPABASE_SERVICE_ROLE_KEY  → la "service_role" key del proyecto de
//                                 Supabase (Project Settings → API).
//                                 NUNCA debe ir en el código del sitio.
//   VISIT_IP_SALT              → cualquier cadena aleatoria larga,
//                                 inventada una vez y no compartida.

const SUPABASE_URL = 'https://yptdxphximblpzlrgjpg.supabase.co';

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      // Todavía no se ha configurado el secreto en Cloudflare: no rompemos
      // la página, simplemente no contamos la visita.
      return new Response(JSON.stringify({ ok: false, reason: 'missing_config' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const salt = env.VISIT_IP_SALT || 'dragonbarbudo';
    const ipHash = await sha256Hex(ip + ':' + salt);

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/track_site_visit`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_ip_hash: ipHash })
    });

    // Siempre 200 (el resultado real va en "ok"): Cloudflare sustituye
    // cualquier respuesta 5xx de una Function por su propia página de
    // error genérica, así que devolver 502 aquí ocultaba el motivo real.
    return new Response(JSON.stringify({ ok: resp.ok }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
