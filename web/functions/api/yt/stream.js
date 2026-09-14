// Cloudflare Pages Function: /api/yt/stream
// Resuelve la URL directa del flujo de audio para reproducir en el navegador

export async function onRequest(context) {
  const { request } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=1800'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response(JSON.stringify({ error: 'ID de canción requerido' }), { status: 400, headers: corsHeaders });
    }

    // Instancias para obtener stream de audio
    const streamApis = [
      `https://pipedapi.kavin.rocks/streams/${id}`,
      `https://api.piped.privacydev.net/streams/${id}`,
      `https://pipedapi.leptons.xyz/streams/${id}`,
      `https://invidious.privacydev.net/api/v1/videos/${id}`
    ];

    for (const api of streamApis) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(api, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();

          // Buscar audioStreams (Piped)
          if (data.audioStreams && data.audioStreams.length > 0) {
            // Filtrar y ordenar por mejor calidad m4a / webm
            const bestAudio = data.audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
            return new Response(JSON.stringify({
              url: bestAudio.url,
              bitrate: bestAudio.bitrate,
              mimeType: bestAudio.mimeType,
              title: data.title,
              artist: data.uploader
            }), { headers: corsHeaders });
          }

          // Invidious format
          if (data.adaptiveFormats && data.adaptiveFormats.length > 0) {
            const audioFormats = data.adaptiveFormats.filter(f => f.type && f.type.startsWith('audio/'));
            if (audioFormats.length > 0) {
              const bestAudio = audioFormats.sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0))[0];
              return new Response(JSON.stringify({
                url: bestAudio.url,
                bitrate: bestAudio.bitrate,
                mimeType: bestAudio.type,
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

    return new Response(JSON.stringify({ error: 'No se pudo obtener el stream de audio' }), { status: 502, headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}
