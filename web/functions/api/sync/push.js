// Cloudflare Pages Function: /api/sync/push
// Recibe favoritos, playlists e historial para sincronizarlos en Cloudflare D1

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no soportado' }), { status: 405, headers: corsHeaders });
  }

  try {
    const db = env.DB;
    const body = await request.json().catch(() => ({}));
    const userId = request.headers.get('X-User-Id') || body.userId;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId requerido en header X-User-Id o body' }), { status: 400, headers: corsHeaders });
    }

    const { favorites = [], playlists = [], history = [] } = body;
    const now = Date.now();

    if (db) {
      const statements = [];

      // 1. Asegurar usuario
      statements.push(
        db.prepare(
          `INSERT INTO users (id, created_at, last_sync_at) 
           VALUES (?, ?, ?) 
           ON CONFLICT(id) DO UPDATE SET last_sync_at = ?`
        ).bind(userId, now, now, now)
      );

      // 2. Insertar o actualizar favoritos
      for (const fav of favorites) {
        statements.push(
          db.prepare(
            `INSERT INTO favorites (user_id, song_id, title, artists, album, duration, thumbnail_url, liked_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, song_id) DO UPDATE SET
               title = excluded.title,
               artists = excluded.artists,
               album = excluded.album,
               duration = excluded.duration,
               thumbnail_url = excluded.thumbnail_url,
               liked_at = excluded.liked_at,
               updated_at = excluded.updated_at`
          ).bind(
            userId,
            fav.id || fav.songId,
            fav.title || '',
            fav.artists || fav.artist || '',
            fav.album || '',
            fav.duration || 0,
            fav.thumbnailUrl || '',
            fav.likedAt || now,
            now
          )
        );
      }

      // 3. Insertar o actualizar playlists
      for (const pl of playlists) {
        statements.push(
          db.prepare(
            `INSERT INTO playlists (id, user_id, name, description, thumbnail_url, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               description = excluded.description,
               thumbnail_url = excluded.thumbnail_url,
               updated_at = excluded.updated_at`
          ).bind(
            pl.id,
            userId,
            pl.name || 'Playlist',
            pl.description || '',
            pl.thumbnailUrl || '',
            pl.createdAt || now,
            now
          )
        );

        // Si incluye canciones para la playlist
        if (Array.isArray(pl.songs)) {
          // Limpiar tracks anteriores para actualizar
          statements.push(
            db.prepare(`DELETE FROM playlist_songs WHERE playlist_id = ?`).bind(pl.id)
          );

          pl.songs.forEach((s, idx) => {
            statements.push(
              db.prepare(
                `INSERT INTO playlist_songs (playlist_id, song_id, position, title, artists, album, duration, thumbnail_url, added_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
              ).bind(
                pl.id,
                s.id || s.songId,
                idx,
                s.title || '',
                s.artists || s.artist || '',
                s.album || '',
                s.duration || 0,
                s.thumbnailUrl || '',
                s.addedAt || now
              )
            );
          });
        }
      }

      // 4. Insertar historial
      for (const h of history.slice(0, 50)) { // Limitar a las últimas 50
        statements.push(
          db.prepare(
            `INSERT INTO history (user_id, song_id, title, artists, album, duration, thumbnail_url, played_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            userId,
            h.id || h.songId,
            h.title || '',
            h.artists || h.artist || '',
            h.album || '',
            h.duration || 0,
            h.thumbnailUrl || '',
            h.playedAt || now
          )
        );
      }

      if (statements.length > 0) {
        await db.batch(statements);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      syncedAt: now,
      counts: {
        favorites: favorites.length,
        playlists: playlists.length,
        history: history.length
      }
    }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}
