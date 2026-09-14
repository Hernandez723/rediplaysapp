// Metrolist Web - YouTube Music API Client

export const YTMusic = {
  // Buscar canciones
  async search(query) {
    if (!query) return [];

    // 1. Consultar el Worker / API de Cloudflare
    try {
      const res = await fetch(`/api/yt/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          return data.results;
        }
      }
    } catch (e) {
      console.warn('Endpoint local /api/yt/search no disponible o en carga inicial, reintentando...', e);
    }

    // 2. Fallbacks de instancias públicas con control de timeout
    const fallbacks = [
      `https://pipedapi.leptons.xyz/search?q=${encodeURIComponent(query)}&filter=music_songs`,
      `https://api.piped.privacydev.net/search?q=${encodeURIComponent(query)}&filter=music_songs`,
      `https://invidious.privacydev.net/api/v1/search?q=${encodeURIComponent(query)}&type=video`
    ];

    for (const url of fallbacks) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const fallbackRes = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          const items = Array.isArray(data) ? data : (data.items || []);
          const mapped = items.map(item => {
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

          if (mapped.length > 0) return mapped;
        }
      } catch (err) {
        continue;
      }
    }

    return [];
  },

  // Obtener URL del flujo de audio
  async getStream(songId) {
    if (!songId) return null;

    // 1. Consultar el Worker / API de Cloudflare
    try {
      const res = await fetch(`/api/yt/stream?id=${songId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.url) return data.url;
      }
    } catch (e) {
      console.warn('Endpoint local /api/yt/stream no disponible, probando fallback...', e);
    }

    // 2. Fallbacks de streaming
    const streamFallbacks = [
      `https://pipedapi.leptons.xyz/streams/${songId}`,
      `https://api.piped.privacydev.net/streams/${songId}`,
      `https://invidious.privacydev.net/api/v1/videos/${songId}`
    ];

    for (const url of streamFallbacks) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const fallbackRes = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          if (data.audioStreams && data.audioStreams.length > 0) {
            const best = data.audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
            return best.url;
          }
          if (data.adaptiveFormats && data.adaptiveFormats.length > 0) {
            const audioFormats = data.adaptiveFormats.filter(f => f.type && f.type.startsWith('audio/'));
            if (audioFormats.length > 0) {
              const best = audioFormats.sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0))[0];
              return best.url;
            }
          }
        }
      } catch (err) {
        continue;
      }
    }

    return null;
  },

  // Obtener letras
  async getLyrics(title, artist, duration = 0) {
    try {
      const res = await fetch(`/api/yt/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&duration=${duration}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}

    try {
      const lrclibRes = await fetch(`https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`);
      if (lrclibRes.ok) {
        return await lrclibRes.json();
      }
    } catch (err) {}

    return { plainLyrics: '', syncedLyrics: '' };
  }
};
