// Cloudflare Pages Function: /api/sync/pull
// Obtiene los favoritos, playlists e historial actualizados para la Web o App

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const userId = request.headers.get('X-User-Id') || url.searchParams.get('userId');
    const since = parseInt(url.searchParams.get('since') || '0', 10);

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId requerido' }), { status: 400, headers: corsHeaders });
    }

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({
        favorites: [],
        playlists: [],
        history: [],
        syncedAt: Date.now()
      }), { headers: corsHeaders });
    }

    // 1. Obtener favoritos
    const favoritesResult = await db.prepare(
      `SELECT song_id as id, title, artists, album, duration, thumbnail_url as thumbnailUrl, liked_at as likedAt, updated_at as updatedAt
       FROM favorites 
       WHERE user_id = ? AND updated_at >= ?
       ORDER BY liked_at DESC`
    ).bind(userId, since).all();

    // 2. Obtener playlists
    const playlistsResult = await db.prepare(
      `SELECT id, name, description, thumbnail_url as thumbnailUrl, created_at as createdAt, updated_at as updatedAt
       FROM playlists 
       WHERE user_id = ? AND updated_at >= ?
       ORDER BY updated_at DESC`
    ).bind(userId, since).all();

    const playlists = playlistsResult.results || [];

    // Cargar canciones de cada playlist
    for (const pl of playlists) {
      const songsResult = await db.prepare(
        `SELECT song_id as id, position, title, artists, album, duration, thumbnail_url as thumbnailUrl, added_at as addedAt
         FROM playlist_songs 
         WHERE playlist_id = ?
         ORDER BY position ASC`
      ).bind(pl.id).all();
      pl.songs = songsResult.results || [];
    }

    // 3. Obtener historial reciente
    const historyResult = await db.prepare(
      `SELECT song_id as id, title, artists, album, duration, thumbnail_url as thumbnailUrl, played_at as playedAt
       FROM history 
       WHERE user_id = ? AND played_at >= ?
       ORDER BY played_at DESC
       LIMIT 50`
    ).bind(userId, since).all();

    return new Response(JSON.stringify({
      success: true,
      favorites: favoritesResult.results || [],
      playlists: playlists,
      history: historyResult.results || [],
      syncedAt: Date.now()
    }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}
