// Cloudflare Pages Function: elimina una cuenta de verdad (Auth + su fila
// en "profiles", si hay ON DELETE CASCADE configurado). Solo funciona si
// quien llama está autenticado como una de las cuentas admin: se verifica
// aquí, en el servidor, con el propio token de quien llama (nunca nos
// fiamos del "isAdmin" del navegador, que cualquiera podría falsear).
//
// Usa el mismo secreto SUPABASE_SERVICE_ROLE_KEY ya configurado para
// /api/track-visit (Cloudflare Pages → Settings → Environment variables).
// No hace falta añadir nada nuevo si ese ya está puesto.

const SUPABASE_URL = 'https://yptdxphximblpzlrgjpg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdGR4cGh4aW1ibHB6bHJnanBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MTI2ODIsImV4cCI6MjEwNDA4ODY4Mn0.aA2jm-SC6xRI1_klg-17M-Po81RZP6dnpDfRBDQq_gc';
const ADMIN_EMAILS = ['dragonbarbudo.game@gmail.com'];

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost(context) {
  // Siempre respondemos con status 200 (el resultado real va en el campo
  // "ok" del JSON): Cloudflare sustituye cualquier respuesta 5xx de una
  // Function por su propia página de error genérica, ocultando el motivo
  // real del fallo al código que llama a esta función.
  try {
    const { request, env } = context;
    if (!env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: 'missing_config' }, 200);

    const authHeader = request.headers.get('Authorization') || '';
    const { userId } = await request.json().catch(() => ({}));
    if (!userId || !authHeader.startsWith('Bearer ')) return json({ ok: false, error: 'missing_params' }, 200);

    // 1) ¿Quién llama? Se comprueba con SU propio token, nunca con la
    //    service_role key, para saber de verdad quién es sin poder falsearlo.
    const meResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: authHeader }
    });
    if (!meResp.ok) return json({ ok: false, error: 'invalid_session' }, 200);
    const me = await meResp.json();
    const callerEmail = (me?.email || '').trim().toLowerCase();
    if (!ADMIN_EMAILS.includes(callerEmail)) return json({ ok: false, error: 'forbidden' }, 200);

    // 2) Ya sabemos que quien llama es admin: ahora sí, con la service_role
    //    key, se borra la cuenta indicada.
    const delResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    });
    // Si falla, devolvemos el motivo real (p.ej. una fila en otra tabla
    // que todavía apunta a este usuario sin ON DELETE CASCADE): antes se
    // perdía y solo se veía "no se pudo eliminar", sin pista de por qué.
    if (!delResp.ok) {
      const detail = await delResp.text().catch(() => '');
      return json({ ok: false, error: 'delete_failed', status: delResp.status, detail }, 200);
    }
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
}
