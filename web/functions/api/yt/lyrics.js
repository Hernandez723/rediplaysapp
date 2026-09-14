// Cloudflare Pages Function: /api/yt/lyrics
// Obtiene letras sincronizadas desde LrcLib

export async function onRequest(context) {
  const { request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=86400'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const title = url.searchParams.get('title');
    const artist = url.searchParams.get('artist');
    const duration = url.searchParams.get('duration');

    if (!title || !artist) {
      return new Response(JSON.stringify({ error: 'title y artist requeridos' }), { status: 400, headers: corsHeaders });
    }

    // Consultar LrcLib (mismo servicio que usa Metrolist en Android)
    let lrclibUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
    if (duration && parseInt(duration) > 0) {
      lrclibUrl += `&duration=${parseInt(duration)}`;
    }

    const res = await fetch(lrclibUrl, {
      headers: { 'User-Agent': 'Metrolist-Web/1.0' }
    });

    if (res.ok) {
      const data = await res.json();
      return new Response(JSON.stringify({
        plainLyrics: data.plainLyrics || '',
        syncedLyrics: data.syncedLyrics || '',
        instrumental: data.instrumental || false
      }), { headers: corsHeaders });
    }

    // Búsqueda aproximada si get directo falla
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

    return new Response(JSON.stringify({ plainLyrics: '', syncedLyrics: '', notFound: true }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}
