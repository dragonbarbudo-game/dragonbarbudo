// Cloudflare Pages Function: guarda una SOLICITUD de registro (todavía
// no crea ninguna cuenta) y avisa por correo al admin para que la
// apruebe a mano. El registro público de Supabase está cerrado (ver
// Authentication → "Allow new users to sign up", desactivado): la
// única forma de entrar es que el admin apruebe la solicitud desde el
// Panel de Admin, lo que sí crea la cuenta de verdad e invita a esa
// persona por correo.
//
// Variables de entorno necesarias (las mismas que ya usan las demás
// funciones de correo — no hace falta añadir nada nuevo):
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY

const SUPABASE_URL = 'https://yptdxphximblpzlrgjpg.supabase.co';
const ADMIN_NOTIFY_EMAIL = 'dragonbarbudo.game@gmail.com';

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function onRequestPost(context) {
  // Siempre respondemos con status 200 (el resultado real va en "ok"):
  // Cloudflare sustituye cualquier respuesta 5xx de una Function por su
  // propia página de error genérica, ocultando el motivo real del fallo.
  try {
    const { request, env } = context;
    if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: 'missing_config' }, 200);

    const { username, email } = await request.json().catch(() => ({}));
    if (!username || !email) return json({ ok: false, error: 'missing_params' }, 200);

    const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/registration_requests`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ username, email, status: 'pending' })
    });
    if (!insertResp.ok) return json({ ok: false, error: 'insert_failed' }, 200);

    // Si el correo de aviso falla, la solicitud ya ha quedado guardada
    // igualmente: el admin la verá en el panel aunque no llegue el aviso.
    if (env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'DragonBarbudo <noreply@dragonbarbudo.net>',
          to: ADMIN_NOTIFY_EMAIL,
          subject: '🔔 Nueva solicitud de registro en DragonBarbudo',
          html: `<p>Alguien quiere unirse a DragonBarbudo:</p>
                 <p><strong>Usuario:</strong> ${escapeHtml(username)}<br>
                 <strong>Correo:</strong> ${escapeHtml(email)}</p>
                 <p>Entra al Panel de Admin → Solicitudes de registro para aprobarla o rechazarla.</p>`
        })
      }).catch(() => {});
    }

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
}
