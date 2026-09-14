// Cloudflare Pages Function: /api/yt/search
// Búsqueda de canciones, artistas y álbumes en YouTube Music mediante Piped/Invidious/Innertube API pública

export async function onRequest(context) {
  const { request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    if (!query) {
      return new Response(JSON.stringify({ results: [] }), { headers: corsHeaders });
    }

    // Lista de instancias públicas de API compatibles para alta disponibilidad
    const apiEndpoints = [
      `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=music_songs`,
      `https://api.piped.privacydev.net/search?q=${encodeURIComponent(query)}&filter=music_songs`,
      `https://pipedapi.leptons.xyz/search?q=${encodeURIComponent(query)}&filter=music_songs`,
      `https://invidious.privacydev.net/api/v1/search?q=${encodeURIComponent(query)}&type=video`
    ];

    let items = [];

    for (const endpoint of apiEndpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(endpoint, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const rawItems = Array.isArray(data) ? data : (data.items || []);

          items = rawItems.map(item => {
            const urlPath = item.url || '';
            const videoId = item.videoId || (urlPath.includes('/watch?v=') ? urlPath.split('/watch?v=')[1] : urlPath.replace('/', ''));
            return {
              id: videoId,
              title: item.title || 'Canción desconocida',
              artist: item.uploaderName || item.author || item.artist || 'Artista',
              artists: item.uploaderName || item.author || item.artist || 'Artista',
              album: item.album || '',
              duration: item.duration || 0,
              thumbnailUrl: item.thumbnail || (item.thumbnails && item.thumbnails[0]?.url) || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            };
          }).filter(i => i.id && i.id.length >= 8);

          if (items.length > 0) break;
        }
      } catch (err) {
        // Intentar siguiente endpoint
        continue;
      }
    }

    return new Response(JSON.stringify({ results: items }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message, results: [] }), { status: 500, headers: corsHeaders });
  }
}
