// Cloudflare Unified Worker & Pages Handler (_worker.js)
// Maneja todas las rutas /api/* y sirve los archivos estáticos

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id, X-Pairing-Code',
      'Access-Control-Max-Age': '86400',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Rutas de API
    if (pathname.startsWith('/api/')) {
      try {
        // 1. BÚSQUEDA DE MÚSICA (/api/yt/search)
        if (pathname === '/api/yt/search') {
          const query = url.searchParams.get('q') || '';
          if (!query) {
            return new Response(JSON.stringify({ results: [] }), { headers: corsHeaders });
          }

          // A) Intentar con YouTube Music Innertube API oficial (WEB_REMIX)
          try {
            const ytRes = await fetch('https://music.youtube.com/youtubei/v1/search', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              },
              body: JSON.stringify({
                context: {
                  client: {
                    clientName: 'WEB_REMIX',
                    clientVersion: '1.20240101.01.00',
                    hl: 'es',
                    gl: 'US'
                  }
                },
                query: query
              })
            });

            if (ytRes.ok) {
              const ytData = await ytRes.json();
              const items = parseYouTubeMusicSearchResults(ytData);
              if (items.length > 0) {
                return new Response(JSON.stringify({ results: items }), {
                  headers: { ...corsHeaders, 'Cache-Control': 'public, max-age=1800' }
                });
              }
            }
          } catch (e) {
            console.warn('Innertube direct fetch failed, trying piped instances...', e);
          }

          // B) Fallback a instancias Piped / Invidious desde el servidor de Cloudflare
          const fallbackApis = [
            `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=music_songs`,
            `https://api.piped.privacydev.net/search?q=${encodeURIComponent(query)}&filter=music_songs`,
            `https://pipedapi.leptons.xyz/search?q=${encodeURIComponent(query)}&filter=music_songs`,
            `https://invidious.privacydev.net/api/v1/search?q=${encodeURIComponent(query)}&type=video`
          ];

          for (const api of fallbackApis) {
            try {
              const res = await fetch(api, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
              });
              if (res.ok) {
                const data = await res.json();
                const rawItems = Array.isArray(data) ? data : (data.items || []);
                const items = rawItems.map(item => {
                  const urlPath = item.url || '';
                  const videoId = item.videoId || (urlPath.includes('/watch?v=') ? urlPath.split('/watch?v=')[1] : urlPath.replace('/', ''));
                  return {
                    id: videoId,
                    title: item.title || 'Canción',
                    artist: item.uploaderName || item.author || item.artist || 'Artista',
                    artists: item.uploaderName || item.author || item.artist || 'Artista',
                    album: item.album || '',
                    duration: item.duration || 0,
                    thumbnailUrl: item.thumbnail || (item.thumbnails && item.thumbnails[0]?.url) || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                  };
                }).filter(i => i.id && i.id.length >= 8);

                if (items.length > 0) {
                  return new Response(JSON.stringify({ results: items }), { headers: corsHeaders });
                }
              }
            } catch (err) {
              continue;
            }
          }

          return new Response(JSON.stringify({ results: [] }), { headers: corsHeaders });
        }

        // 2. OBTENER STREAM DE AUDIO (/api/yt/stream)
        if (pathname === '/api/yt/stream') {
          const id = url.searchParams.get('id');
          if (!id) {
            return new Response(JSON.stringify({ error: 'ID requerido' }), { status: 400, headers: corsHeaders });
          }

          const streamApis = [
            `https://pipedapi.kavin.rocks/streams/${id}`,
            `https://api.piped.privacydev.net/streams/${id}`,
            `https://pipedapi.leptons.xyz/streams/${id}`,
            `https://invidious.privacydev.net/api/v1/videos/${id}`
          ];

          for (const api of streamApis) {
            try {
              const res = await fetch(api, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
              });
              if (res.ok) {
                const data = await res.json();
                if (data.audioStreams && data.audioStreams.length > 0) {
                  const best = data.audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
                  return new Response(JSON.stringify({
                    url: best.url,
                    bitrate: best.bitrate,
                    mimeType: best.mimeType,
                    title: data.title,
                    artist: data.uploader
                  }), { headers: corsHeaders });
                }
                if (data.adaptiveFormats && data.adaptiveFormats.length > 0) {
                  const audioFormats = data.adaptiveFormats.filter(f => f.type && f.type.startsWith('audio/'));
                  if (audioFormats.length > 0) {
                    const best = audioFormats.sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0))[0];
                    return new Response(JSON.stringify({
                      url: best.url,
                      bitrate: best.bitrate,
                      mimeType: best.type,
                      title: data.title,
                      artist: data.author
                    }), { headers: corsHeaders });
                  }
                }
              }
            } catch (err) {
              continue;
            }
          }

          return new Response(JSON.stringify({ error: 'No se pudo resolver el stream de audio' }), { status: 502, headers: corsHeaders });
        }

        // 3. LETRAS (/api/yt/lyrics)
        if (pathname === '/api/yt/lyrics') {
          const title = url.searchParams.get('title') || '';
          const artist = url.searchParams.get('artist') || '';
          const duration = url.searchParams.get('duration') || '';

          if (!title) {
            return new Response(JSON.stringify({ error: 'title requerido' }), { status: 400, headers: corsHeaders });
          }

          let lrclibUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
          if (duration && parseInt(duration) > 0) {
            lrclibUrl += `&duration=${parseInt(duration)}`;
          }

          try {
            const res = await fetch(lrclibUrl, { headers: { 'User-Agent': 'Metrolist-Web/1.0' } });
            if (res.ok) {
              const data = await res.json();
              return new Response(JSON.stringify({
                plainLyrics: data.plainLyrics || '',
                syncedLyrics: data.syncedLyrics || '',
                instrumental: data.instrumental || false
              }), { headers: corsHeaders });
            }
          } catch (e) {}

          try {
            const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(title + ' ' + artist)}`, {
              headers: { 'User-Agent': 'Metrolist-Web/1.0' }
            });
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              if (Array.isArray(searchData) && searchData.length > 0) {
                const match = searchData[0];
                return new Response(JSON.stringify({
                  plainLyrics: match.plainLyrics || '',
                  syncedLyrics: match.syncedLyrics || '',
                  instrumental: match.instrumental || false
                }), { headers: corsHeaders });
              }
            }
          } catch (e) {}

          return new Response(JSON.stringify({ plainLyrics: '', syncedLyrics: '' }), { headers: corsHeaders });
        }

        // 4. AUTENTICACIÓN / VINCULACIÓN (/api/auth/pair)
        if (pathname === '/api/auth/pair') {
          const body = await request.json().catch(() => ({}));
          const { action, pairingCode, userId } = body;
          const db = env?.DB;
          const now = Date.now();

          if (action === 'create_or_get') {
            const finalUserId = userId || crypto.randomUUID();
            const finalPairingCode = Math.floor(100000 + Math.random() * 900000).toString();

            if (db) {
              await db.prepare(
                `INSERT INTO users (id, pairing_code, created_at, last_sync_at) 
                 VALUES (?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET last_sync_at = ?`
              ).bind(finalUserId, finalPairingCode, now, now, now).run().catch(() => {});
            }

            return new Response(JSON.stringify({
              success: true,
              userId: finalUserId,
              pairingCode: finalPairingCode
            }), { headers: corsHeaders });
          }

          if (action === 'pair_with_code') {
            if (!pairingCode) {
              return new Response(JSON.stringify({ error: 'Código requerido' }), { status: 400, headers: corsHeaders });
            }

            if (db) {
              const user = await db.prepare(
                `SELECT id, pairing_code FROM users WHERE pairing_code = ?`
              ).bind(pairingCode.toString().trim()).first();

              if (!user) {
                return new Response(JSON.stringify({ error: 'Código inválido o no encontrado' }), { status: 404, headers: corsHeaders });
              }

              return new Response(JSON.stringify({
                success: true,
                userId: user.id,
                pairingCode: user.pairing_code
              }), { headers: corsHeaders });
            }

            return new Response(JSON.stringify({
              success: true,
              userId: 'user-' + pairingCode,
              pairingCode: pairingCode
            }), { headers: corsHeaders });
          }
        }

        // 5. SINCRONIZACIÓN PUSH (/api/sync/push)
        if (pathname === '/api/sync/push') {
          const body = await request.json().catch(() => ({}));
          const userId = request.headers.get('X-User-Id') || body.userId;
          const db = env?.DB;
          const now = Date.now();

          if (!userId) {
            return new Response(JSON.stringify({ error: 'userId requerido' }), { status: 400, headers: corsHeaders });
          }

          const { favorites = [], playlists = [], history = [] } = body;

          if (db) {
            const stmts = [];
            stmts.push(
              db.prepare(
                `INSERT INTO users (id, created_at, last_sync_at) 
                 VALUES (?, ?, ?) 
                 ON CONFLICT(id) DO UPDATE SET last_sync_at = ?`
              ).bind(userId, now, now, now)
            );

            for (const fav of favorites) {
              stmts.push(
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

            for (const pl of playlists) {
              stmts.push(
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

              if (Array.isArray(pl.songs)) {
                stmts.push(db.prepare(`DELETE FROM playlist_songs WHERE playlist_id = ?`).bind(pl.id));
                pl.songs.forEach((s, idx) => {
                  stmts.push(
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

            if (stmts.length > 0) {
              await db.batch(stmts).catch(e => console.warn('D1 batch sync error:', e));
            }
          }

          return new Response(JSON.stringify({ success: true, syncedAt: now }), { headers: corsHeaders });
        }

        // 6. SINCRONIZACIÓN PULL (/api/sync/pull)
        if (pathname === '/api/sync/pull') {
          const userId = request.headers.get('X-User-Id') || url.searchParams.get('userId');
          const since = parseInt(url.searchParams.get('since') || '0', 10);
          const db = env?.DB;

          if (!userId) {
            return new Response(JSON.stringify({ error: 'userId requerido' }), { status: 400, headers: corsHeaders });
          }

          if (db) {
            const favs = await db.prepare(
              `SELECT song_id as id, title, artists, album, duration, thumbnail_url as thumbnailUrl, liked_at as likedAt, updated_at as updatedAt
               FROM favorites WHERE user_id = ? AND updated_at >= ? ORDER BY liked_at DESC`
            ).bind(userId, since).all().catch(() => ({ results: [] }));

            const pls = await db.prepare(
              `SELECT id, name, description, thumbnail_url as thumbnailUrl, created_at as createdAt, updated_at as updatedAt
               FROM playlists WHERE user_id = ? AND updated_at >= ? ORDER BY updated_at DESC`
            ).bind(userId, since).all().catch(() => ({ results: [] }));

            const playlists = pls.results || [];
            for (const pl of playlists) {
              const songs = await db.prepare(
                `SELECT song_id as id, position, title, artists, album, duration, thumbnail_url as thumbnailUrl, added_at as addedAt
                 FROM playlist_songs WHERE playlist_id = ? ORDER BY position ASC`
              ).bind(pl.id).all().catch(() => ({ results: [] }));
              pl.songs = songs.results || [];
            }

            const hist = await db.prepare(
              `SELECT song_id as id, title, artists, album, duration, thumbnail_url as thumbnailUrl, played_at as playedAt
               FROM history WHERE user_id = ? AND played_at >= ? ORDER BY played_at DESC LIMIT 50`
            ).bind(userId, since).all().catch(() => ({ results: [] }));

            return new Response(JSON.stringify({
              success: true,
              favorites: favs.results || [],
              playlists: playlists,
              history: hist.results || [],
              syncedAt: Date.now()
            }), { headers: corsHeaders });
          }

          return new Response(JSON.stringify({
            success: true,
            favorites: [],
            playlists: [],
            history: [],
            syncedAt: Date.now()
          }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({ error: 'Endpoint no encontrado' }), { status: 404, headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // Servir assets estáticos (Cloudflare Pages / Workers Assets)
    if (env && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return fetch(request);
  }
};

// Parser para la respuesta JSON de YouTube Music Innertube
function parseYouTubeMusicSearchResults(data) {
  const results = [];
  try {
    const sections = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    for (const section of sections) {
      const contents = section?.musicShelfRenderer?.contents || section?.musicCardShelfRenderer?.contents || [];
      for (const item of contents) {
        const flexRenderer = item?.musicResponsiveListItemRenderer;
        if (!flexRenderer) continue;

        const flexColumns = flexRenderer.flexColumns || [];
        const titleColumn = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.title?.runs?.[0]?.text;
        const subtitleRuns = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.title?.runs || [];

        let artist = 'Artista';
        let album = '';
        if (subtitleRuns.length > 0) {
          artist = subtitleRuns[0]?.text || 'Artista';
          if (subtitleRuns.length >= 3) {
            album = subtitleRuns[2]?.text || '';
          }
        }

        const videoId = flexRenderer?.playlistItemData?.videoId || flexRenderer?.doubleTapToLikeRenderer?.target?.videoId;
        const thumbnails = flexRenderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
        const thumb = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        if (videoId && titleColumn) {
          results.push({
            id: videoId,
            title: titleColumn,
            artist: artist,
            artists: artist,
            album: album,
            duration: 0,
            thumbnailUrl: thumb
          });
        }
      }
    }
  } catch (err) {
    console.warn('Error parseando Innertube JSON:', err);
  }
  return results;
}
