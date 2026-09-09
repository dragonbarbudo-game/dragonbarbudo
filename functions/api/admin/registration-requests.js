// Cloudflare Pages Function: gestiona las solicitudes de registro
// pendientes (listar / aprobar / rechazar). Solo funciona si quien llama
// está autenticado como una cuenta admin: se verifica aquí, en el
// servidor, con el propio token de quien llama (igual que
// /api/admin/delete-user).
//
// Aprobar una solicitud invita a esa persona por correo con la propia
// API de Supabase (ella elige su contraseña al abrir el enlace): así se
// crea la cuenta de verdad sin tener que reabrir el registro público.
//
// Usa las mismas variables de entorno que ya usan las demás funciones
// de admin — no hace falta añadir nada nuevo:
//   SUPABASE_SERVICE_ROLE_KEY

const SUPABASE_URL = 'https://yptdxphximblpzlrgjpg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdGR4cGh4aW1ibHB6bHJnanBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MTI2ODIsImV4cCI6MjEwNDA4ODY4Mn0.aA2jm-SC6xRI1_klg-17M-Po81RZP6dnpDfRBDQq_gc';
const ADMIN_EMAILS = ['dragonbarbudo.game@gmail.com'];

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// ¿Quién llama? Se comprueba con SU propio token, nunca con la
// service_role key, para saber de verdad quién es sin poder falsearlo.
async function verifyAdmin(request) {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return false;
  const meResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: authHeader }
  });
  if (!meResp.ok) return false;
  const me = await meResp.json();
  return ADMIN_EMAILS.includes((me?.email || '').trim().toLowerCase());
}

export async function onRequestPost(context) {
  // Siempre respondemos con status 200 (el resultado real va en "ok"):
  // Cloudflare sustituye cualquier respuesta 5xx de una Function por su
  // propia página de error genérica, ocultando el motivo real del fallo.
  try {
    const { request, env } = context;
    if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: 'missing_config' }, 200);
    if (!(await verifyAdmin(request))) return json({ ok: false, error: 'forbidden' }, 200);

    const { action, id, username, email } = await request.json().catch(() => ({}));
    const svcHeaders = {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    };

    if (action === 'list') {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/registration_requests?status=eq.pending&order=created_at.asc`,
        { headers: svcHeaders }
      );
      const requests = await resp.json().catch(() => []);
      return json({ ok: resp.ok, requests: Array.isArray(requests) ? requests : [] }, 200);
    }

    if (action === 'reject') {
      if (!id) return json({ ok: false, error: 'missing_params' }, 200);
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/registration_requests?id=eq.${id}`, {
        method: 'PATCH', headers: svcHeaders, body: JSON.stringify({ status: 'rejected' })
      });
      return json({ ok: resp.ok }, 200);
    }

    if (action === 'approve') {
      if (!id || !email) return json({ ok: false, error: 'missing_params' }, 200);
      const inviteResp = await fetch(`${SUPABASE_URL}/auth/v1/invite`, {
        method: 'POST', headers: svcHeaders,
        body: JSON.stringify({ email, data: { username: username || '' } })
      });
      const inviteBody = await inviteResp.json().catch(() => ({}));
      if (!inviteResp.ok) return json({ ok: false, error: inviteBody?.msg || inviteBody?.error_description || 'invite_failed' }, 200);

      await fetch(`${SUPABASE_URL}/rest/v1/registration_requests?id=eq.${id}`, {
        method: 'PATCH', headers: svcHeaders, body: JSON.stringify({ status: 'approved' })
      });
      return json({ ok: true }, 200);
    }

    return json({ ok: false, error: 'unknown_action' }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
}
