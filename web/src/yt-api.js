// Metrolist Web - YouTube Music API Client

export const YTMusic = {
  // Buscar canciones
  async search(query) {
    try {
      const res = await fetch(`/api/yt/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          return data.results;
        }
      }
    } catch (e) {
      console.warn('Fallo al consultar backend de búsqueda local, probando fallback Piped directo...', e);
    }

    // Fallback directo en el cliente si no hay backend activo
    try {
      const fallbackRes = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=music_songs`);
      if (fallbackRes.ok) {
        const items = await fallbackRes.json();
        return (items || []).map(item => ({
          id: item.url ? item.url.replace('/watch?v=', '') : (item.videoId || ''),
          title: item.title,
          artist: item.uploaderName || 'Artista',
          artists: item.uploaderName || 'Artista',
          album: '',
          duration: item.duration || 0,
          thumbnailUrl: item.thumbnail || `https://i.ytimg.com/vi/${item.url ? item.url.replace('/watch?v=', '') : ''}/hqdefault.jpg`
        })).filter(i => i.id);
      }
    } catch (err) {
      console.error('Error en búsqueda de fallback:', err);
    }

    return [];
  },

  // Obtener URL del flujo de audio
  async getStream(songId) {
    try {
      const res = await fetch(`/api/yt/stream?id=${songId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.url) return data.url;
      }
    } catch (e) {
      console.warn('Fallo en endpoint local de stream, probando fallback Piped...', e);
    }

    // Fallback directo
    try {
      const fallbackRes = await fetch(`https://pipedapi.kavin.rocks/streams/${songId}`);
      if (fallbackRes.ok) {
        const data = await fallbackRes.json();
        if (data.audioStreams && data.audioStreams.length > 0) {
          const best = data.audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
          return best.url;
        }
      }
    } catch (err) {
      console.error('Error al resolver audio directo:', err);
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
    } catch (e) {
      console.warn('Fallo al obtener letras del backend, intentando LrcLib directo...', e);
    }

    try {
      const lrclibRes = await fetch(`https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`);
      if (lrclibRes.ok) {
        return await lrclibRes.json();
      }
    } catch (err) {
      console.error('Error al consultar LrcLib:', err);
    }

    return { plainLyrics: '', syncedLyrics: '' };
  }
};
