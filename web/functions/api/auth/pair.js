// Cloudflare Pages Function: /api/auth/pair
// Permite vincular la App Android y la Web mediante un PIN o generar un nuevo usuario

export async function onRequest(context) {
  const { request, env } = context;

  // Habilitar CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Pairing-Code',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = env.DB;
    const now = Date.now();

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { action, pairingCode, userId } = body;

      if (action === 'create_or_get') {
        // Generar nuevo usuario o devolver existente
        let finalUserId = userId || crypto.randomUUID();
        let finalPairingCode = Math.floor(100000 + Math.random() * 900000).toString(); // PIN de 6 dígitos

        if (db) {
          await db.prepare(
            `INSERT INTO users (id, pairing_code, created_at, last_sync_at) 
             VALUES (?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET last_sync_at = ?`
          ).bind(finalUserId, finalPairingCode, now, now, now).run();
        }

        return new Response(JSON.stringify({
          success: true,
          userId: finalUserId,
          pairingCode: finalPairingCode
        }), { headers: corsHeaders });
      }

      if (action === 'pair_with_code') {
        // Buscar usuario por código de vinculación
        if (!pairingCode) {
          return new Response(JSON.stringify({ error: 'Código de vinculación requerido' }), { status: 400, headers: corsHeaders });
        }

        if (db) {
          const user = await db.prepare(
            `SELECT id, pairing_code FROM users WHERE pairing_code = ?`
          ).bind(pairingCode.toString().trim()).first();

          if (!user) {
            return new Response(JSON.stringify({ error: 'Código inválido o expirado' }), { status: 404, headers: corsHeaders });
          }

          return new Response(JSON.stringify({
            success: true,
            userId: user.id,
            pairingCode: user.pairing_code
          }), { headers: corsHeaders });
        } else {
          // Modo fallback local si no hay D1 configurado aún
          return new Response(JSON.stringify({
            success: true,
            userId: 'local-' + pairingCode,
            pairingCode: pairingCode
          }), { headers: corsHeaders });
        }
      }

      return new Response(JSON.stringify({ error: 'Acción no reconocida' }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: 'Método no soportado' }), { status: 405, headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}
