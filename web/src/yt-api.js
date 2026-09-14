// Metrolist Web - YouTube Music API Client

export const YTMusic = {
  // Buscar canciones
  async search(query) {
    if (!query || !query.trim()) return [];

    try {
      const res = await fetch(`/api/yt/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.results)) {
          return data.results;
        }
      }
    } catch (e) {
      console.warn('Error al consultar /api/yt/search:', e);
    }

    return [];
  },

  // Obtener detalles, canciones y perfil de un artista
  async getArtist(artistName) {
    if (!artistName || !artistName.trim()) return null;

    try {
      const res = await fetch(`/api/yt/artist?name=${encodeURIComponent(artistName.trim())}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Error al consultar /api/yt/artist:', e);
    }

    return null;
  },

  // Obtener URL del flujo de audio
  async getStream(songId) {
    if (!songId) return null;

    try {
      const res = await fetch(`/api/yt/stream?id=${songId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.url) return data.url;
      }
    } catch (e) {
      console.warn('Error al consultar /api/yt/stream:', e);
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
      console.warn('Error al consultar /api/yt/lyrics:', e);
    }

    return { plainLyrics: '', syncedLyrics: '' };
  }
};
