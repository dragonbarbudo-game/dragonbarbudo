// Cloudflare Pages Function: recibe un aviso de Supabase cuando se
// actualiza una fila de auth.users, y si detecta que email_confirmed_at
// acaba de pasar de vacío a tener fecha (justo el instante en que
// alguien confirma su cuenta por primera vez), manda el correo de
// "ya estás registrado" con Resend.
//
// auth.users se actualiza también en cada inicio de sesión (last_sign_in_at
// cambia), así que este aviso llega muchas veces a lo largo de la vida de
// una cuenta: por eso se comprueba el ANTES/DESPUÉS de email_confirmed_at
// (old_record vs record) en vez de fiarse de "se ha actualizado la fila".
// Esa comprobación solo da "true" una vez por cuenta, la primera vez que
// se confirma, así que nunca se manda dos veces.
//
// Variables de entorno necesarias (Cloudflare Pages → Settings →
// Environment variables):
//   RESEND_API_KEY          → clave de API de tu cuenta de Resend.
//   SUPABASE_WEBHOOK_SECRET → cualquier texto largo aleatorio, inventado
//                              una vez. El MISMO valor va también en la
//                              cabecera Authorization que manda Supabase
//                              (ver el SQL/trigger que crea el aviso), así
//                              nadie más puede llamar a esta URL y mandar
//                              correos en tu nombre.

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost(context) {
  // Importante: siempre respondemos con status 200 (el resultado real va en
  // el campo "ok" del JSON). Cloudflare intercepta y sustituye por su propia
  // página de error genérica cualquier respuesta 5xx de una Function, así
  // que devolver 500/502 aquí ocultaba el motivo real del fallo.
  try {
    const { request, env } = context;

    if (!env.SUPABASE_WEBHOOK_SECRET || !env.RESEND_API_KEY) {
      return json({ ok: false, error: 'missing_config' }, 200);
    }

    const authHeader = request.headers.get('Authorization') || '';
    if (authHeader !== `Bearer ${env.SUPABASE_WEBHOOK_SECRET}`) {
      return json({ ok: false, error: 'forbidden' }, 200);
    }

    const payload = await request.json().catch(() => null);
    if (!payload) return json({ ok: false, error: 'bad_payload' }, 200);

    const oldRecord = payload.old_record || {};
    const record = payload.record || {};
    const justConfirmed = !oldRecord.email_confirmed_at && !!record.email_confirmed_at;

    if (!justConfirmed || !record.email) {
      // No es el instante exacto de confirmar (p. ej. es solo un inicio de
      // sesión que actualizó otra columna), o no hay correo: no hacemos nada.
      return json({ ok: true, skipped: true }, 200);
    }

    const meta = record.raw_user_meta_data || {};
    const displayName = meta.username || meta.full_name || record.email.split('@')[0];

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'DragonBarbudo <noreply@dragonbarbudo.net>',
        to: record.email,
        subject: '🐉 ¡Tu cuenta ya está activa!',
        html: welcomeEmailHtml(displayName)
      })
    });

    const resendBody = await resp.text().catch(() => '');
    return json({ ok: resp.ok, resendStatus: resp.status, resendBody }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 200);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function welcomeEmailHtml(name) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d0f14;padding:40px 0;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#171a21;border:1px solid #33302a;border-radius:14px;overflow:hidden;">
      <tr><td align="center" style="background:#14161c;padding:28px 20px;border-bottom:2px solid #d9a441;">
        <img src="https://dragonbarbudo.net/logo-dragonbarbudo-oscuro.png" alt="DragonBarbudo" width="200" style="display:block;max-width:200px;height:auto;">
      </td></tr>
      <tr><td style="padding:36px 34px 10px;">
        <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;color:#d9a441;font-size:13px;letter-spacing:1px;text-transform:uppercase;">¡Ya eres uno de los nuestros!</p>
        <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;color:#f4f1e8;font-size:24px;line-height:1.3;">${escapeHtml(name)}, tu cuenta está activa 🎉</h1>
        <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;color:#c9c3b4;font-size:15px;line-height:1.6;">
          Tu correo ha quedado confirmado y tu cuenta de DragonBarbudo ya funciona por completo. Entra cuando quieras, reúne a tus amigos y que empiece la partida.
        </p>
      </td></tr>
      <tr><td align="center" style="padding:0 34px 34px;">
        <a href="https://dragonbarbudo.net" style="display:inline-block;background:#d9a441;color:#171817;font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:15px;text-decoration:none;padding:14px 34px;border-radius:8px;">
          Entrar a DragonBarbudo
        </a>
      </td></tr>
      <tr><td style="padding:18px 34px;background:#0f1116;border-top:1px solid #2a2c33;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;color:#6b6656;font-size:11px;text-align:center;">
          DragonBarbudo © 2026 · <a href="https://dragonbarbudo.net/privacy.html" style="color:#a8935e;">Política de privacidad</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}
